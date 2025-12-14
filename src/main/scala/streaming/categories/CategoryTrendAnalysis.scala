package streaming.categories

import com.typesafe.config.ConfigFactory
import org.apache.spark.sql.{Dataset, Row, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

object CategoryTrendAnalysis {

  def main(args: Array[String]): Unit = {

    val config = ConfigFactory.load()


    val kafkaBootstrap = config.getString("kafka.bootstrap")
    val cleanedTopic   = config.getString("kafka.topic.cleaned")
    val categoryTrendsTopic =
      if (config.hasPath("kafka.topic.categoryTrends")) config.getString("kafka.topic.categoryTrends")
      else "category-trends"


    val mongoUri      = config.getString("mongo.uri")
    val mongoDatabase = config.getString("mongo.database")
    val categoryTrendsCollection =
      if (config.hasPath("mongo.collection.categoryTrends")) config.getString("mongo.collection.categoryTrends")
      else "category_trends"


    val sparkAppName =
      if (config.hasPath("spark.appName")) config.getString("spark.appName") else "NewsPipeline"
    val sparkMaster =
      if (config.hasPath("spark.master")) config.getString("spark.master") else "local[*]"

    val spark = SparkSession.builder()
      .appName(s"$sparkAppName-CategoryTrendAnalysis")
      .master(sparkMaster)
      .config("spark.sql.session.timeZone", "UTC")
      .config("spark.mongodb.connection.uri", mongoUri)
      .config("spark.sql.streaming.statefulOperator.checkCorrectness.enabled", "false")
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


    val events = parsed
      .withColumn("category", coalesce(col("category"), lit("other")))
      .withColumn("published_ts", to_timestamp(col("published")))
      .filter(col("published_ts").isNotNull)
      .select(col("published_ts"), col("category"))


    val windowedCounts = events
      .withWatermark("published_ts", "10 minutes")
      .groupBy(
        window(col("published_ts"), "20 minutes", "5 minutes"),
        col("category")
      )
      .agg(count(lit(1)).as("category_count"))
      .withColumn("window_start", col("window.start"))
      .withColumn("window_end", col("window.end"))
      .drop("window")


    val analyzed = windowedCounts
      .withColumn(
        "activity_level",
        when(col("category_count") >= 5, "SPIKE")
          .when(col("category_count") >= 3, "ACTIVE")
          .otherwise("NORMAL")
      )
      .withColumn("created_at", current_timestamp())


    val out = analyzed.select(
      col("window_start"),
      col("window_end"),
      col("category"),
      col("category_count"),
      col("activity_level"),
      col("created_at")
    )


    out.writeStream
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>


        batchDF.write
          .format("mongodb")
          .mode("append")
          .option("spark.mongodb.database", mongoDatabase)
          .option("spark.mongodb.collection", categoryTrendsCollection)
          .save()


        val kafkaOut = batchDF
          .withColumn("key", col("category").cast("string"))
          .select(
            col("key"),
            to_json(
              struct(
                col("window_start"),
                col("window_end"),
                col("category"),
                col("category_count"),
                col("activity_level"),
                col("created_at")
              )
            ).alias("value")
          )

        kafkaOut.write
          .format("kafka")
          .option("kafka.bootstrap.servers", kafkaBootstrap)
          .option("topic", categoryTrendsTopic)
          .save()
      }
      .option("checkpointLocation", "checkpoint/category-trends-foreach")
      .start()

    spark.streams.awaitAnyTermination()
  }
}
