package com.blueprint.fixture.lockers;

import java.nio.file.Files;
import java.nio.file.Path;

public final class MainSmokeTest {
    public static void main(String[] args) throws Exception {
        Path directory = Files.createTempDirectory("parcel-locker-cli");
        Path config = directory.resolve("service.properties");
        Path manifest = directory.resolve("manifest.csv");
        Files.writeString(config, "pickup.window.hours=24\ndefault.zone=CENTRAL\n");
        Files.writeString(manifest, "trackingId,recipientId,lockerSize,zone,pickupCode\n"
                + "PK-CLI,cli-user,SMALL,CENTRAL,7711\n");

        Main.main(new String[]{config.toString(), manifest.toString()});
        System.out.println("MainSmokeTest passed");
    }
}
