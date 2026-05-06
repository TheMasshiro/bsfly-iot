#ifndef MOISTURE_UTILS_H
#define MOISTURE_UTILS_H

int moisturePercentFromRawValue(int raw, int rawDry, int rawWet);
const char *moistureRawRangeTag(int raw, int rawDry, int rawWet);

#endif
