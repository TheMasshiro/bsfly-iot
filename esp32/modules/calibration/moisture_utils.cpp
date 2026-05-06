#include "moisture_utils.h"

int moisturePercentFromRawValue(int raw, int rawDry, int rawWet) {
  // Swap if rawDry < rawWet (handle inverted range)
  if (rawDry < rawWet) {
    int temp = rawDry;
    rawDry = rawWet;
    rawWet = temp;
  }
  
  // Map from [rawWet, rawDry] to [100, 0]
  if (raw <= rawWet) return 100;
  if (raw >= rawDry) return 0;
  
  int mapped = (raw - rawWet) * 100 / (rawDry - rawWet);
  return 100 - mapped;
}

const char* moistureRawRangeTag(int raw, int rawDry, int rawWet) {
  // Swap if rawDry < rawWet
  if (rawDry < rawWet) {
    int temp = rawDry;
    rawDry = rawWet;
    rawWet = temp;
  }
  
  if (raw == 0) return "INVALID";
  if (raw > rawDry) return "ABOVE_DRY";
  if (raw < rawWet) return "BELOW_WET";
  return "IN_RANGE";
}
