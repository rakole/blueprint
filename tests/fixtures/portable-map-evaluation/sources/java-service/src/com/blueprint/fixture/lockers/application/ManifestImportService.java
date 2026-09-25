package com.blueprint.fixture.lockers.application;

import java.nio.file.Path;
import java.util.List;

public final class ManifestImportService {
    private final ManifestReader manifestReader;
    private final DeliveryApplicationService deliveryService;

    public ManifestImportService(ManifestReader manifestReader, DeliveryApplicationService deliveryService) {
        this.manifestReader = manifestReader;
        this.deliveryService = deliveryService;
    }

    public List<DeliveryReceipt> importFile(Path path) {
        return manifestReader.read(path).stream()
                .map(line -> deliveryService.accept(new CreateDeliveryCommand(
                        line.trackingId(),
                        line.recipientId(),
                        line.requestedSize(),
                        line.zone(),
                        line.pickupCode())))
                .toList();
    }
}
