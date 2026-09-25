package com.blueprint.fixture.lockers.application;

import java.time.Instant;

@FunctionalInterface
public interface TimeSource {
    Instant now();
}
