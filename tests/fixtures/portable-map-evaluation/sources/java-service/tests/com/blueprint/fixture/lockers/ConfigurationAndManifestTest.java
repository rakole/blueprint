package com.blueprint.fixture.lockers;

import com.blueprint.fixture.lockers.adapter.CsvManifestReader;
import com.blueprint.fixture.lockers.application.ManifestLine;
import com.blueprint.fixture.lockers.config.PropertiesServiceConfigLoader;
import com.blueprint.fixture.lockers.config.ServiceConfig;
import com.blueprint.fixture.lockers.domain.LockerSize;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

public final class ConfigurationAndManifestTest {
    public static void main(String[] args) throws Exception {
        Path directory = Files.createTempDirectory("parcel-locker-test");
        Path config = directory.resolve("service.properties");
        Files.writeString(config, "pickup.window.hours=12\ndefault.zone=WEST\n");
        ServiceConfig loaded = new PropertiesServiceConfigLoader().load(config);
        check(loaded.pickupWindow().equals(Duration.ofHours(12)), "configuration should parse pickup window");
        check(loaded.defaultZone().equals("WEST"), "configuration should parse default zone");

        Path manifest = directory.resolve("manifest.csv");
        Files.writeString(manifest, "trackingId,recipientId,lockerSize,zone,pickupCode\n"
                + " PK-1 , recipient-1 , medium , WEST , 9001 \n\n"
                + "PK-2,recipient-2,SMALL,EAST,9002\n");
        List<ManifestLine> lines = new CsvManifestReader().read(manifest);
        check(lines.size() == 2, "reader should ignore header and blank lines");
        check(lines.get(0).requestedSize() == LockerSize.MEDIUM, "reader should translate locker size");
        check(lines.get(0).trackingId().equals("PK-1"), "reader should trim identifiers");
        check(lines.get(1).zone().equals("EAST"), "reader should preserve zone");
        System.out.println("ConfigurationAndManifestTest passed");
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
