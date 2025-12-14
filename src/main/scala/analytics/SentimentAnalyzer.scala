package analytics

import com.typesafe.config.ConfigFactory
import org.apache.spark.sql.{Dataset, Row, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._

object SentimentAnalyzer {

  def main(args: Array[String]): Unit = {

    val config = ConfigFactory.load()


    val kafkaBootstrap = config.getString("kafka.bootstrap")
    val cleanedTopic = config.getString("kafka.topic.cleaned")
    val sentimentTopic =
      if (config.hasPath("kafka.topic.sentiment")) config.getString("kafka.topic.sentiment")
      else "news-sentiment"


    val mongoUri = config.getString("mongo.uri")
    val mongoDatabase = config.getString("mongo.database")
    val sentimentCollection =
      if (config.hasPath("mongo.collection.sentiment")) config.getString("mongo.collection.sentiment")
      else "news_sentiment"


    val sparkAppName =
      if (config.hasPath("spark.appName")) config.getString("spark.appName") else "NewsPipeline"
    val sparkMaster =
      if (config.hasPath("spark.master")) config.getString("spark.master") else "local[*]"

    val spark = SparkSession.builder()
      .appName(s"$sparkAppName-SentimentAnalysis")
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


    val base = parsed
      .withColumn("title", coalesce(col("title"), lit("")))
      .withColumn("content", coalesce(col("content"), lit("")))
      .withColumn("category", coalesce(col("category"), lit("other")))
      .withColumn("source_normalized", coalesce(col("source_normalized"), lit("Unknown")))
      .withColumn("published_ts", to_timestamp(col("published")))
      .filter(col("published_ts").isNotNull)
      .withColumn("text", lower(trim(concat_ws(" ", col("title"), col("content")))))


    val positiveWords = Seq(
      "good","great","positive","success","win","wins","winning","growth","improve","improved","improvement",
      "benefit","benefits","hope","peace","stable","stability","agreement","deal","recovery","support",
      "boost","strong","record","best","profit","profits","safe","safer","resolved","solution","progress",
      "breakthrough","aid","relief","approval","celebrate","bullish"
    )

    val negativeWords = Seq(
      "bad","worse","worst","negative","loss","losses","down","drop","crash","collapse","recession","inflation",
      "war","attack","bomb","strike","killed","dead","deaths","injured","violence","protest","riot","terror",
      "earthquake","disaster","emergency","crisis","fear","threat","sanction","conflict","shutdown","layoff",
      "fraud","scandal","arrest","accident","outage","fire","flood","drought","bearish"
    )

    val posSqlArray = positiveWords.map(w => s"'${w.replace("'", "\\'")}'").mkString(",")
    val negSqlArray = negativeWords.map(w => s"'${w.replace("'", "\\'")}'").mkString(",")

    val posExpr = s"array($posSqlArray)"
    val negExpr = s"array($negSqlArray)"


    val tokenExpr =
      """
        |filter(
        |  split(
        |    trim(regexp_replace(text, '[^\\p{L}\\p{N}]+', ' ')),
        |    '\\s+'
        |  ),
        |  x -> length(x) >= 2 AND NOT x rlike '^[0-9]+$'
        |)
      """.stripMargin

    val withTokens = base.withColumn("tokens", expr(tokenExpr))


    val posCountExpr = s"size(filter(tokens, x -> array_contains($posExpr, x)))"
    val negCountExpr = s"size(filter(tokens, x -> array_contains($negExpr, x)))"

    val scored = withTokens
      .withColumn("positive_count", expr(posCountExpr))
      .withColumn("negative_count", expr(negCountExpr))
      .withColumn("sentiment_score", col("positive_count") - col("negative_count"))
      .withColumn(
        "sentiment",
        when(col("sentiment_score") > 0, "Positive")
          .when(col("sentiment_score") < 0, "Negative")
          .otherwise("Neutral")
      )
      .withColumn("created_at", current_timestamp())


    val out = scored.select(
      col("published_ts").alias("published"),
      col("source_normalized"),
      col("category"),
      col("title"),
      col("link"),
      col("keywords"),
      col("positive_count"),
      col("negative_count"),
      col("sentiment_score"),
      col("sentiment"),
      col("created_at")
    )


    out.writeStream
      .foreachBatch { (batchDF: Dataset[Row], batchId: Long) =>

        batchDF.write
          .format("mongodb")
          .mode("append")
          .option("spark.mongodb.database", mongoDatabase)
          .option("spark.mongodb.collection", sentimentCollection)
          .save()

        val kafkaOut = batchDF
          .withColumn("key", col("category").cast("string"))
          .select(
            col("key"),
            to_json(
              struct(
                col("published"),
                col("source_normalized"),
                col("category"),
                col("title"),
                col("link"),
                col("keywords"),
                col("positive_count"),
                col("negative_count"),
                col("sentiment_score"),
                col("sentiment"),
                col("created_at")
              )
            ).alias("value")
          )

        kafkaOut.write
          .format("kafka")
          .option("kafka.bootstrap.servers", kafkaBootstrap)
          .option("topic", sentimentTopic)
          .save()
      }
      .option("checkpointLocation", "checkpoint/sentiment-foreach")
      .start()

    spark.streams.awaitAnyTermination()
  }
}
