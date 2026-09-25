package com.blueprint.fixture.lockers;

import com.blueprint.fixture.lockers.adapter.ConsoleNotificationAdapter;
import com.blueprint.fixture.lockers.adapter.CsvManifestReader;
import com.blueprint.fixture.lockers.adapter.FixedTimeSource;
import com.blueprint.fixture.lockers.adapter.InMemoryDeliveryRepository;
import com.blueprint.fixture.lockers.adapter.InMemoryLockerRepository;
import com.blueprint.fixture.lockers.application.DeliveryApplicationService;
import com.blueprint.fixture.lockers.application.ManifestImportService;
import com.blueprint.fixture.lockers.config.PropertiesServiceConfigLoader;
import com.blueprint.fixture.lockers.config.ServiceConfig;
import com.blueprint.fixture.lockers.domain.Locker;
import com.blueprint.fixture.lockers.domain.LockerSize;
import com.blueprint.fixture.lockers.domain.ZoneAwareLockerPolicy;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) {
        Path configPath = args.length > 0 ? Path.of(args[0]) : Path.of("config/default.properties");
        ServiceConfig config = new PropertiesServiceConfigLoader().load(configPath);
        InMemoryDeliveryRepository deliveries = new InMemoryDeliveryRepository();
        InMemoryLockerRepository lockers = new InMemoryLockerRepository(List.of(
                new Locker("N-101", LockerSize.SMALL, config.defaultZone()),
                new Locker("N-102", LockerSize.MEDIUM, config.defaultZone()),
                new Locker("N-201", LockerSize.LARGE, config.defaultZone())));
        DeliveryApplicationService service = new DeliveryApplicationService(
                deliveries,
                lockers,
                new ZoneAwareLockerPolicy(),
                new ConsoleNotificationAdapter(),
                new FixedTimeSource(Instant.parse("2026-01-01T09:00:00Z")),
                config.pickupWindow());

        if (args.length > 1) {
            List<?> receipts = new ManifestImportService(new CsvManifestReader(), service)
                    .importFile(Path.of(args[1]));
            System.out.println("Imported deliveries: " + receipts.size());
        } else {
            System.out.println("Parcel Locker service ready for zone " + config.defaultZone());
        }
    }
}
