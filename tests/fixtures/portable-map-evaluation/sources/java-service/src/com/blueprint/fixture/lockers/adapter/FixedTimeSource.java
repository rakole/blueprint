package com.blueprint.fixture.lockers.adapter;

import com.blueprint.fixture.lockers.application.TimeSource;

import java.time.Instant;

public final class FixedTimeSource implements TimeSource {
    private final Instant instant;

    public FixedTimeSource(Instant instant) {
        this.instant = instant;
    }

    @Override
    public Instant now() {
        return instant;
    }
}
