package com.marketroute.fulfillment.adapter;

import com.marketroute.fulfillment.domain.FoodBox;
import java.util.Arrays;

public final class CsvBoxReader {
    public FoodBox read(String line) {
        String[] fields = line.split(",", -1);
        if (fields.length != 2) throw new IllegalArgumentException("box CSV needs id and weight");
        return new FoodBox(fields[0].trim(), Double.parseDouble(fields[1].trim()));
    }
}
