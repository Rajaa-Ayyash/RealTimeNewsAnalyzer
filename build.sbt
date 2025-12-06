ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / scalaVersion := "2.12.10"

lazy val root = (project in file("."))
  .settings(
    name := "RealTimeNewsAnalyzer",
    libraryDependencies ++= Seq(
      // Spark
      "org.apache.spark" %% "spark-core" % "3.5.0",
      "org.apache.spark" %% "spark-sql"  % "3.5.0",
      "org.apache.spark" %% "spark-streaming" % "3.5.0",

      // Mongo
      "org.mongodb.spark" %% "mongo-spark-connector" % "3.0.1",
      "org.mongodb" % "mongodb-driver-sync" % "4.9.0",

      // Kafka client
      "org.apache.kafka" % "kafka-clients" % "3.5.0",
      "com.rometools" % "rome" % "1.18.0",


//  application.conf
      "com.typesafe" % "config" % "1.4.3",

      // logging
      "org.slf4j" % "slf4j-api" % "1.7.36",
      "org.slf4j" % "slf4j-simple" % "1.7.36"
    )
  )
