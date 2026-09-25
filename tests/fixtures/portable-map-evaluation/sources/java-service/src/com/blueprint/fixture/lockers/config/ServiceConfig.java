package com.blueprint.fixture.lockers.config;

import java.time.Duration;
import java.util.Objects;

public record ServiceConfig(Duration pickupWindow, String defaultZone) {
    public ServiceConfig {
        pickupWindow = Objects.requireNonNull(pickupWindow, "pickupWindow");
        defaultZone = requireText(defaultZone, "defaultZone");
        if (pickupWindow.isZero() || pickupWindow.isNegative()) {
            throw new IllegalArgumentException("pickupWindow must be positive");
        }
    }

    private static String requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        return value.trim();
    }
}
