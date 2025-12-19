package streaming.breaking

import org.apache.spark.sql.{SparkSession, Dataset, Row}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import com.typesafe.config.ConfigFactory
import streaming.utils.CountMinSketch


object BreakingNewsDetectorJob {

  def main(args: Array[String]): Unit = {

    val config = ConfigFactory.load()

    val kafkaBootstrap = config.getString("kafka.bootstrap")
    val cleanedTopic   = config.getString("kafka.topic.cleaned")
    val breakingTopic  = "breaking-news"

    val mongoUri       = config.getString("mongo.uri")
    val mongoDatabase  = config.getString("mongo.database")
    val breakingCollection = "breaking_events"

    val sparkAppName = config.getString("spark.appName")
    val sparkMaster  = config.getString("spark.master")

    val spark = SparkSession.builder()
      .appName(s"$sparkAppName-BreakingNews")
      .master(sparkMaster)
      .config("spark.mongodb.connection.uri", mongoUri)
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
        col("keyword"),
        col("title"),
        col("link")
      )



    val windowedCounts = exploded
      .withWatermark("published_ts", "5 minutes")
      .groupBy(
        window(col("published_ts"), "5 minutes", "1 minute"),
        col("category"),
        col("keyword")
      )
      .agg(
        count(lit(1)).as("exact_count"),
        slice(collect_set(col("title")), 1, 3).as("sample_titles"),
        slice(collect_set(col("link")),  1, 3).as("sample_links")
      )


    val BREAKING_THRESHOLD =15

    val query = windowedCounts.writeStream
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>

        import spark.implicits._


        val cms = new CountMinSketch(
          width = 1000,
          depth = 5
        )


        val rows = batchDF.collect()

        val breakingRows = rows.flatMap { row =>
          val window     = row.getAs[Row]("window")
          val category   = row.getAs[String]("category")
          val keyword    = row.getAs[String]("keyword")
          val exactCount = row.getAs[Long]("exact_count")
          val sampleTitles = row.getAs[Seq[String]]("sample_titles")
          val sampleLinks  = row.getAs[Seq[String]]("sample_links")


          var i = 0
          while (i < exactCount.toInt) {
            cms.add(keyword)
            i += 1
          }
          val approxCount = cms.estimateCount(keyword)

          if (approxCount >= BREAKING_THRESHOLD) {
            Some((
              window.getAs[java.sql.Timestamp]("start"),
              window.getAs[java.sql.Timestamp]("end"),
              category,
              keyword,
              exactCount,
              approxCount,
              sampleTitles,
              sampleLinks,
              "BREAKING",
              java.time.Instant.now().toString
            ))
          } else None
        }


        if (breakingRows.nonEmpty) {

          val breakingDF = spark.createDataset(breakingRows).toDF(
            "window_start",
           "window_end",
           "category",
           "keyword",
           "exact_count",
           "approx_count",
           "sample_titles",
           "sample_links",
           "status",
           "detected_at"
          )


          breakingDF.write
            .format("mongodb")
            .mode("append")
            .option("spark.mongodb.database", mongoDatabase)
            .option("spark.mongodb.collection", breakingCollection)
            .save()


          val kafkaOut = breakingDF
            .withColumn("key", col("category"))
            .select(
              col("key"),
              to_json(
                struct(
                  col("window_start"),
                  col("window_end"),
                  col("category"),
                  col("keyword"),
                  col("exact_count"),
                  col("approx_count"),
                  col("sample_titles"),
                  col("sample_links"),
                  col("status"),
                  col("detected_at")
                )
              ).alias("value")
            )

          kafkaOut.write
            .format("kafka")
            .option("kafka.bootstrap.servers", kafkaBootstrap)
            .option("topic", breakingTopic)
            .save()
        }
      }

      .option("checkpointLocation", "checkpoint/breaking-news")
      .start()


    spark.streams.awaitAnyTermination()
  }
}
