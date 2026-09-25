package com.blueprint.fixture.lockers.domain;

public enum LockerSize {
    SMALL,
    MEDIUM,
    LARGE;

    public boolean fits(LockerSize requested) {
        return ordinal() >= requested.ordinal();
    }
}
