package producer

import com.typesafe.config.ConfigFactory
import org.apache.kafka.clients.producer.{KafkaProducer, ProducerRecord}
import org.apache.kafka.common.serialization.StringSerializer

import java.time.{ZoneId, ZonedDateTime}
import java.time.format.DateTimeFormatter
import java.util.{Properties, UUID, Locale}

object SyntheticNewsInjector {

  private val config = ConfigFactory.load()
  private val bootstrap = config.getString("kafka.bootstrap")
  private val rawTopic  = config.getString("kafka.topic.raw")

  private val props = new Properties()
  props.put("bootstrap.servers", bootstrap)
  props.put("key.serializer", classOf[StringSerializer].getName)
  props.put("value.serializer", classOf[StringSerializer].getName)
  props.put("acks", "all")

  private val producer = new KafkaProducer[String, String](props)


  private val fmt = DateTimeFormatter
    .ofPattern("EEE MMM dd HH:mm:ss z yyyy", Locale.ENGLISH)

  private def nowPublishedUtc(): String =
    ZonedDateTime.now(ZoneId.of("UTC")).format(fmt)

  private def escape(str: String): String =
    Option(str).getOrElse("")
      .replace("\"", "'")
      .replace("\n", " ")
      .replace("\r", " ")

  private def sendRaw(source: String, title: String, content: String): Unit = {
    val link = s"http://injected.local/${UUID.randomUUID().toString}"
    val json =
      s"""
         |{
         |  "source": "${escape(source)}",
         |  "title": "${escape(title)}",
         |  "content": "${escape(content)}",
         |  "link": "$link",
         |  "published": "${nowPublishedUtc()}"
         |}
         |""".stripMargin

    producer.send(new ProducerRecord(rawTopic, json))
  }

  def main(args: Array[String]): Unit = {

    for (i <- 1 to 35) {
      val title = s"Breaking: strong earthquake hits coastal city $i, emergency declared"
      val content =
        "earthquake disaster emergency rescue teams casualties reported. " +
          "earthquake earthquake rescue rescue emergency crisis."
      sendRaw("Injected World News", title, content)
      Thread.sleep(1200)
    }

    for (i <- 1 to 18) {
      val title = s"Bitcoin market surge continues $i as investors react to inflation data"
      val content =
        "bitcoin crypto market price surge stocks trading inflation bank earnings. " +
          "bitcoin market bullish profit growth."
      sendRaw("Injected Business Desk", title, content)
      Thread.sleep(2500)
    }


    for (i <- 1 to 4) {
      val title = s"Local team wins match $i after late goal in league game"
      val content =
        "match league goal football tournament fans celebrate. match goal."
      sendRaw("Injected Sports", title, content)
      Thread.sleep(4000)
    }

    producer.flush()
    producer.close()
    println("✅ Synthetic injection finished.")
  }
}
