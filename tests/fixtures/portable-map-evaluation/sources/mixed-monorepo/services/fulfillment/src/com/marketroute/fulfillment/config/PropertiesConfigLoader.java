package com.marketroute.fulfillment.config;

import java.io.IOException;
import java.io.Reader;
import java.util.Properties;

public final class PropertiesConfigLoader {
    public ServiceConfig load(Reader reader) throws IOException {
        Properties properties = new Properties();
        properties.load(reader);
        return new ServiceConfig(
            properties.getProperty("depot.code", "NORTH-01"),
            Double.parseDouble(properties.getProperty("shelf.capacity.kg", "18")),
            properties.getProperty("event.topic", "dispatch.assigned")
        );
    }
}
