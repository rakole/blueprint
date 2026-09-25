package com.marketroute.fulfillment.domain;

public record Depot(String code, double shelfCapacityKg) {
    public Depot {
        if (code == null || code.isBlank() || shelfCapacityKg <= 0) {
            throw new IllegalArgumentException("a depot needs a code and positive capacity");
        }
    }
}
