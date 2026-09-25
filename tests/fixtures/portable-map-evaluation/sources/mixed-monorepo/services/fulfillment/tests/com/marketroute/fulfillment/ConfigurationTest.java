package com.marketroute.fulfillment;

import com.marketroute.fulfillment.config.PropertiesConfigLoader;
import java.io.StringReader;

public final class ConfigurationTest {
    public static void main(String[] args) throws Exception {
        var config = new PropertiesConfigLoader().load(new StringReader("depot.code=SOUTH-02\nshelf.capacity.kg=9\nevent.topic=dispatch.assigned\n"));
        assert config.depotCode().equals("SOUTH-02");
        assert config.shelfCapacityKg() == 9;
    }
}
