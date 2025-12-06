package producer

import com.typesafe.config.ConfigFactory
import org.apache.kafka.clients.producer.{KafkaProducer, ProducerRecord}
import org.apache.kafka.common.serialization.StringSerializer
import com.rometools.rome.io.{SyndFeedInput, XmlReader, ParsingFeedException}
import java.net.URL
import java.util.{Properties, Timer, TimerTask}
import scala.collection.mutable

object NewsProducer {


  private val config = ConfigFactory.load()

  private val bootstrapServers = config.getString("kafka.bootstrap")
  private val rawTopic = config.getString("kafka.topic.raw")
  private val rssSources = config.getStringList("rss.sources")
  private val fetchInterval = config.getLong("rss.fetchInterval")


  private val props = new Properties()
  props.put("bootstrap.servers", bootstrapServers)
  props.put("key.serializer", classOf[StringSerializer].getName)
  props.put("value.serializer", classOf[StringSerializer].getName)
  props.put("acks", "all")

  private val producer = new KafkaProducer[String, String](props)


  private val sentNewsTitles = mutable.Set[String]()

  def main(args: Array[String]): Unit = {

    println(s"🔄 NewsProducer started… Fetching RSS every ${fetchInterval / 1000} seconds.")

    val timer = new Timer()

    timer.scheduleAtFixedRate(
      new TimerTask {
        override def run(): Unit = fetchAndSend()
      },
      0,
      fetchInterval
    )
  }


  private def fetchAndSend(): Unit = {

    var newCount = 0

    rssSources.forEach { url =>

      try {
        val feed = new SyndFeedInput().build(new XmlReader(new URL(url)))
        val entries = feed.getEntries

        if (entries.isEmpty)
          println(s"ℹ️ No new items in feed: $url")

        entries.forEach { entry =>
          val title = entry.getTitle

          if (!sentNewsTitles.contains(title)) {

            sentNewsTitles += title
            newCount += 1

            val content =
              if (entry.getDescription != null) entry.getDescription.getValue else ""

            val json =
              s"""
                 |{
                 |  "source": "${escape(feed.getTitle)}",
                 |  "title": "${escape(title)}",
                 |  "content": "${escape(content)}",
                 |  "link": "${entry.getLink}",
                 |  "published": "${entry.getPublishedDate}"
                 |}
                 |""".stripMargin

            producer.send(new ProducerRecord(rawTopic, json))
            println(s"📨 Sent article from ${feed.getTitle}: $title")
          }
        }

      } catch {

        case xmlErr: ParsingFeedException =>
          println(s"❌ XML Parsing Error: $url → ${xmlErr.getMessage}")

        case sslErr: javax.net.ssl.SSLHandshakeException =>
          println(s"🔒 SSL Handshake error (site blocking bot?): $url")

        case io: java.io.IOException =>
          println(s"🌐 Network error fetching $url → ${io.getMessage}")

        case ex: Exception =>
          println(s"⚠️ Unexpected error fetching $url → ${ex.getMessage}")
      }
    }


    if (newCount == 0)
      println("ℹ️ No NEW unique news in this cycle.")
    else
      println(s"✅ Added $newCount new articles this cycle.")
  }


  private def escape(str: String): String =
    Option(str).getOrElse("")
      .replace("\"", "'")
      .replace("\n", " ")
}
