package streaming.utils

import scala.util.hashing.MurmurHash3

class CountMinSketch(
                      val width: Int,
                      val depth: Int,
                      val seed: Int = 1
                    ) extends Serializable {

  private val table = Array.fill(depth, width)(0L)

  private def hash(key: String, i: Int): Int = {
    val h = MurmurHash3.stringHash(key, seed + i)
    Math.abs(h % width)
  }

  def add(key: String): Unit = {
    for (i <- 0 until depth) {
      val idx = hash(key, i)
      table(i)(idx) += 1
    }
  }

  def estimateCount(key: String): Long = {
    (0 until depth)
      .map { i =>
        table(i)(hash(key, i))
      }
      .min
  }
}
