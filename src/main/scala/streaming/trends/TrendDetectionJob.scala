package streaming.trends

import org.apache.spark.sql.{SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import com.typesafe.config.ConfigFactory
import org.apache.spark.sql.{Dataset, Row}


object TrendDetectionJob {

  def main(args: Array[String]): Unit = {


    val config = ConfigFactory.load()

    val kafkaBootstrap = config.getString("kafka.bootstrap")
    val cleanedTopic   = config.getString("kafka.topic.cleaned")
    val trendsTopic = config.getString("kafka.topic.trends")


    val mongoUri        = config.getString("mongo.uri")
    val mongoDatabase   = config.getString("mongo.database")
    val trendsCollection = "trending_keywords"

    val sparkAppName = config.getString("spark.appName")
    val sparkMaster  = config.getString("spark.master")


    val spark = SparkSession.builder()
      .appName(s"$sparkAppName-TrendDetection")
      .master(sparkMaster)
      .config("spark.mongodb.connection.uri", mongoUri)
      .config(
        "spark.sql.streaming.statefulOperator.checkCorrectness.enabled",
        "false"
      )
      .getOrCreate()


    spark.sparkContext.setLogLevel("WARN")


    val schema = StructType(Seq(
      StructField("source", StringType),
      StructField("source_normalized", StringType),
      StructField("title", StringType),
      StructField("content", StringType),
      StructField("link", StringType),
      StructField("published", StringType),
      StructField("word_count", IntegerType),
      StructField("keywords", ArrayType(StringType)),
      StructField("category", StringType)
    ))

    val noiseWords = Seq(
      "top","better","best","worst",
      "said","says","say",
      "new","latest","update","updates",
      "report","reports","reported","according",
      "confirmed","announcement","official",
      "statement","claims","sources",
      "today","yesterday","tomorrow",
      "week","weeks","month","months","year","years",
      "time","day","days","hours","minutes",
      "amid","after","before","during","while",
      "following","around","over","under",
      "more","most","less","many","several",
      "news","media","article","story","stories",
      "video","videos","image","images"
    )



    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", kafkaBootstrap)
      .option("subscribe", cleanedTopic)
      .option("startingOffsets", "latest")
      .load()


    val parsed = kafkaDF
      .selectExpr("CAST(value AS STRING) AS json")
      .select(from_json(col("json"), schema).as("data"))
      .select("data.*")


    val exploded = parsed
      .withColumn("published_ts", to_timestamp(col("published")))
      .filter(col("published_ts").isNotNull)
      .withColumn("keyword", explode(col("keywords")))
      .withColumn("keyword", lower(trim(col("keyword"))))
      .filter(length(col("keyword")) > 3)
      .filter(!col("keyword").isin(noiseWords: _*))
      .dropDuplicates("title", "category", "keyword")
      .select(
        col("published_ts"),
        col("category"),
        col("keyword")
      )



    val windowed = exploded
      .withWatermark("published_ts", "5 minutes")
      .withColumn(
        "window",
        window(col("published_ts"), "20 minutes", "10 minutes")
      )
      .withColumn(
        "window_position",
        when(
          col("published_ts") >= col("window.end") - expr("INTERVAL 10 MINUTES"),
          "current"
        ).otherwise("previous")
      )


    val countsByPosition = windowed
      .groupBy(
        col("window"),
        col("category"),
        col("keyword"),
        col("window_position")
      )
      .agg(count(lit(1)).as("count"))


    val trendScores = countsByPosition
      .groupBy("window", "category", "keyword")
      .agg(
        sum(when(col("window_position") === "current", col("count")).otherwise(0))
          .as("current_count"),
        sum(when(col("window_position") === "previous", col("count")).otherwise(0))
          .as("previous_count")
      )
      .withColumn(
        "trend_score",
        col("current_count") / (col("previous_count") + lit(1))
      )
      .filter(col("current_count") >= 3)


    val trends = trendScores
      .withColumn(
        "trend_level",
        when(col("trend_score") >= 8 && col("current_count") >= 10, "BREAKING")
          .when(col("trend_score") >= 4 && col("current_count") >= 5, "HOT")
          .when(col("trend_score") >= 1.5, "WARM")
          .otherwise("NORMAL")
      )
      .withColumn("created_at", current_timestamp())


    val trendsForKafka = trends
      .withColumn("key", col("category").cast("string"))
      .select(
        col("key"),
        to_json(
          struct(
            col("window.start").alias("window_start"),
            col("window.end").alias("window_end"),
            col("category"),
            col("keyword"),
            col("current_count"),
            col("previous_count"),
            col("trend_score"),
            col("trend_level"),
            col("created_at")
          )
        ).alias("value")
      )


    val query = trends.writeStream
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>


        batchDF
          .write
          .format("mongodb")
          .mode("append")
          .option("spark.mongodb.database", mongoDatabase)
          .option("spark.mongodb.collection", trendsCollection)
          .save()


        val kafkaBatch = batchDF
          .withColumn("key", col("category").cast("string"))
          .select(
            col("key"),
            to_json(
              struct(
                col("window.start").alias("window_start"),
                col("window.end").alias("window_end"),
                col("category"),
                col("keyword"),
                col("current_count"),
                col("previous_count"),
                col("trend_score"),
                col("trend_level"),
                col("created_at")
              )
            ).alias("value")
          )

        kafkaBatch
          .write
          .format("kafka")
          .option("kafka.bootstrap.servers", kafkaBootstrap)
          .option("topic", trendsTopic)
          .save()
      }
      .option("checkpointLocation", "checkpoint/trends-foreach")
      .start()

    spark.streams.awaitAnyTermination()



  }
}
