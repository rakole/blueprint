package com.blueprint.fixture.lockers.config;

import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Properties;

public final class PropertiesServiceConfigLoader {
    public ServiceConfig load(Path path) {
        Properties properties = new Properties();
        try (Reader reader = Files.newBufferedReader(path)) {
            properties.load(reader);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read configuration " + path, exception);
        }
        int hours;
        try {
            hours = Integer.parseInt(properties.getProperty("pickup.window.hours", "48"));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("pickup.window.hours must be an integer", exception);
        }
        return new ServiceConfig(
                Duration.ofHours(hours),
                properties.getProperty("default.zone", "NORTH"));
    }
}
