ThisBuild / version := "0.1.0-SNAPSHOT"
ThisBuild / scalaVersion := "2.12.10"

lazy val root = (project in file("."))
  .settings(
    name := "RealTimeNewsAnalyzer",
    libraryDependencies ++= Seq(
      "org.apache.spark" %% "spark-core" % "3.5.0",
      "org.apache.spark" %% "spark-sql"  % "3.5.0",
      "org.apache.spark" %% "spark-streaming" % "3.5.0",
      "org.apache.spark" %% "spark-sql-kafka-0-10" % "3.5.0",

      "org.mongodb.spark" %% "mongo-spark-connector" % "10.3.0",
      "org.mongodb" % "mongodb-driver-sync" % "4.9.0",

      "org.apache.kafka" % "kafka-clients" % "3.5.0",
      "com.rometools" % "rome" % "1.18.0",

      "com.typesafe" % "config" % "1.4.3",

      "org.slf4j" % "slf4j-api" % "1.7.36",
      "org.slf4j" % "slf4j-simple" % "1.7.36"
    )
  )

fork := true

javaOptions ++= Seq(
  "-Dhadoop.home.dir=C:\\hadoop-3.3.5",
  "-Djava.library.path=C:\\hadoop-3.3.5\\bin"
)