package consumer

import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._
import org.apache.spark.sql.types._
import java.util.UUID

object NewsSparkConsumer {

  def main(args: Array[String]): Unit = {

    val spark = SparkSession.builder()
      .appName("Kafka News Streaming Consumer")
      .master("local[*]")
      .config("spark.sql.session.timeZone", "UTC")
      .getOrCreate()

    spark.conf.set("spark.sql.legacy.timeParserPolicy", "LEGACY")
    spark.sparkContext.setLogLevel("WARN")

    val newsSchema = StructType(Seq(
      StructField("source", StringType, nullable = true),
      StructField("title", StringType, nullable = true),
      StructField("content", StringType, nullable = true),
      StructField("link", StringType, nullable = true),
      StructField("published", StringType, nullable = true)
    ))

    val kafkaDF = spark.readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "raw-news")
      .option("startingOffsets", "earliest")
      .load()

    val rawDF = kafkaDF
      .selectExpr("CAST(value AS STRING) as json")
      .select(from_json(col("json"), newsSchema).as("data"))
      .select("data.*")

    val filledDF = rawDF
      .withColumn("source", coalesce(col("source"), lit("")))
      .withColumn("title", coalesce(col("title"), lit("")))
      .withColumn("content", coalesce(col("content"), lit("")))
      .withColumn("link", coalesce(col("link"), lit("")))
      .withColumn("published", coalesce(col("published"), lit("")))

    val lowerDF = filledDF
      .withColumn("source", lower(col("source")))
      .withColumn("title", lower(col("title")))
      .withColumn("content", lower(col("content")))
      .withColumn("link", lower(col("link")))

    val noHtmlDF = lowerDF
      .withColumn("source", regexp_replace(col("source"), "<[^>]*>", " "))
      .withColumn("title", regexp_replace(col("title"), "<[^>]*>", " "))
      .withColumn("content", regexp_replace(col("content"), "<[^>]*>", " "))

    val noEmojiDF = noHtmlDF
      .withColumn("source", regexp_replace(col("source"), "[^\\p{L}\\p{N}\\p{P}\\p{Z}]", " "))
      .withColumn("title", regexp_replace(col("title"), "[^\\p{L}\\p{N}\\p{P}\\p{Z}]", " "))
      .withColumn("content", regexp_replace(col("content"), "[^\\p{L}\\p{N}\\p{P}\\p{Z}]", " "))

    val noBreaksDF = noEmojiDF
      .withColumn("source", regexp_replace(col("source"), "[\\r\\n\\t]+", " "))
      .withColumn("title", regexp_replace(col("title"), "[\\r\\n\\t]+", " "))
      .withColumn("content", regexp_replace(col("content"), "[\\r\\n\\t]+", " "))

    val trimmedDF = noBreaksDF
      .withColumn("source", trim(regexp_replace(col("source"), "\\s+", " ")))
      .withColumn("title", trim(regexp_replace(col("title"), "\\s+", " ")))
      .withColumn("content", trim(regexp_replace(col("content"), "\\s+", " ")))
      .withColumn("link", trim(regexp_replace(col("link"), "\\s+", " ")))

    val withTsDF = trimmedDF
      .withColumn("published_ts", to_timestamp(col("published"), "EEE MMM dd HH:mm:ss z yyyy"))

    val cleanDF = withTsDF
      .filter(col("published_ts").isNotNull)
      .withWatermark("published_ts", "1 minute")
      .dropDuplicates("title")
      .drop("published")
      .withColumnRenamed("published_ts", "published")

    val stopWords = Seq(
      "a","an","the","and","or","but","if","then","else","for","to","of","in","on","at","by","from","with","as",
      "is","are","was","were","be","been","being","this","that","these","those","it","its","they","them","their",
      "you","your","we","our","he","she","his","her","i","me","my","not","no","yes","do","does","did","done",
      "can","could","will","would","should","may","might","must","about","into","over","after","before","more","most",
      "up","down","out","just","than","too","very"
    )
    val stopWordsSqlArray = stopWords.map(w => s"'$w'").mkString(",")
    val stopWordsExpr = s"array($stopWordsSqlArray)"

    val tokenExpr =
      """
        |filter(
        |  split(
        |    trim(regexp_replace(concat(title, ' ', content), '[^\\p{L}\\p{N}]+', ' ')),
        |    '\\s+'
        |  ),
        |  x -> length(x) >= 3 AND NOT x rlike '^[0-9]+$'
        |)
      """.stripMargin

    val tokensNoStopExpr =
      s"filter(tokens, x -> NOT array_contains($stopWordsExpr, x))"

    val freqMapExpr =
      """
        |aggregate(
        |  tokens_ns,
        |  cast(map() as map<string,int>),
        |  (acc, x) -> map_zip_with(
        |      acc,
        |      map(x, 1),
        |      (k, v1, v2) -> coalesce(v1, 0) + coalesce(v2, 0)
        |  ),
        |  acc -> acc
        |)
      """.stripMargin

    val sortedKeywordsExpr =
      """
        |transform(
        |  slice(
        |    array_sort(transform(map_entries(freq_map), e -> struct(-e.value as v, e.key as k))),
        |    1, 8
        |  ),
        |  x -> x.k
        |)
      """.stripMargin

    val enrichedDF = cleanDF
      .withColumn(
        "word_count",
        size(filter(
          split(trim(concat(col("title"), lit(" "), col("content"))), "\\s+"),
          x => length(x) > 0
        ))
      )
      .withColumn("tokens", expr(tokenExpr))
      .withColumn("tokens_ns", expr(tokensNoStopExpr))
      .withColumn("freq_map", expr(freqMapExpr))
      .withColumn("keywords", expr(sortedKeywordsExpr))
      .withColumn("source_normalized",
        when(col("link").contains("ft.com"), "Financial Times")
          .when(col("link").contains("wired.com"), "Wired")
          .when(col("link").contains("engadget.com"), "Engadget")
          .when(col("link").contains("aljazeera.com"), "Al Jazeera")
          .when(col("link").contains("bbc.co") || col("link").contains("bbc.com"), "BBC")
          .when(length(col("source")) === 0, "Unknown")
          .otherwise(initcap(trim(regexp_extract(col("source"), "^[^\\-|—|\\|]+", 0))))
      )
      .withColumn("category",
        when(col("title").rlike("(?i)\\b(election|president|government|parliament|minister|senate|war|ceasefire|diplomacy|policy)\\b"), "politics")
          .when(col("title").rlike("(?i)\\b(ai|artificial intelligence|openai|google|apple|microsoft|software|hardware|chip|gadget|smartphone|netflix|meta|llama|amazon|kindle|ebook|e-reader)\\b"), "tech")
          .when(col("title").rlike("(?i)\\b(match|league|epl|nba|nfl|goal|tournament|wins|beat|cricket|tennis|football|soccer|liverpool)\\b"), "sports")
          .when(col("title").rlike("(?i)\\b(stocks?|market|shares?|earnings|revenue|inflation|bank|trade|deal|acquisition|merger|ipo|borrows?|loan|payments|delinquencies)\\b"), "business")
          .when(col("title").rlike("(?i)\\b(study|research|nasa|space|climate|physics|biology|medical|health|vaccine|quantum|science)\\b"), "science")
          .otherwise("other")
      )
      .drop("tokens", "tokens_ns", "freq_map")

    val mongoCheckpoint = s"file:///C:/spark-checkpoints/mongo-cleaned-articles/${UUID.randomUUID().toString}"

    val mongoQuery = enrichedDF.writeStream
      .format("mongodb")
      .option("spark.mongodb.write.connection.uri", "mongodb://localhost:27017")
      .option("spark.mongodb.write.database", "news_streaming")
      .option("spark.mongodb.write.collection", "cleaned_articles")
      .option("checkpointLocation", mongoCheckpoint)
      .outputMode("append")
      .start()

    mongoQuery.awaitTermination()
  }
}