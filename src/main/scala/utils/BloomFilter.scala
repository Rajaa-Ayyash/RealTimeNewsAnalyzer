package utils

import java.util.BitSet
import scala.util.hashing.MurmurHash3

class BloomFilter(size: Int, hashFunctions: Int){
  private val bitSet = new BitSet(size)

  private def hash(value: String, seed: Int): Int = {
    math.abs(MurmurHash3.stringHash(value, seed) % size)
  }

  def mightContain(value: String): Boolean = {
    (0 until hashFunctions).forall { seed =>
      bitSet.get(hash(value, seed))
    }
  }

  def put(value: String): Unit = {
    (0 until hashFunctions).foreach { seed =>
      bitSet.set(hash(value, seed))
    }
  }
}
