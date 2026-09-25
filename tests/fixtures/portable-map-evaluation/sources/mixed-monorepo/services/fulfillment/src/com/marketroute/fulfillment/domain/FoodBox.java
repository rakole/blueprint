package com.marketroute.fulfillment.domain;

public record FoodBox(String id, double weightKg) {
    public FoodBox {
        if (id == null || id.isBlank() || weightKg <= 0) {
            throw new IllegalArgumentException("a food box needs an id and positive weight");
        }
    }
}
