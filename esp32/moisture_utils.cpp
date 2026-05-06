#include <Arduino.h>

#include "moisture_utils.h"

int moisturePercentFromRawValue(int raw, int rawDry, int rawWet)
{
  if (raw < 0)
    return -1;

  int dry = rawDry;
  int wet = rawWet;

  if (dry == wet)
    return -1;

  if (dry < wet)
  {
    int tmp = dry;
    dry = wet;
    wet = tmp;
  }

  long pct = map(raw, wet, dry, 100, 0);
  return (int)constrain(pct, 0, 100);
}

const char *moistureRawRangeTag(int raw, int rawDry, int rawWet)
{
  if (raw < 0)
    return "INVALID";

  int dry = rawDry;
  int wet = rawWet;

  if (dry < wet)
  {
    int tmp = dry;
    dry = wet;
    wet = tmp;
  }

  if (raw > dry)
    return "ABOVE_DRY";
  if (raw < wet)
    return "BELOW_WET";

  return "IN_RANGE";
}
