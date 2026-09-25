package com.marketroute.fulfillment.application;

import com.marketroute.fulfillment.domain.Depot;
import com.marketroute.fulfillment.domain.DispatchEvent;
import com.marketroute.fulfillment.domain.DispatchStatus;
import com.marketroute.fulfillment.domain.FoodBox;
import com.marketroute.fulfillment.domain.ShelfAssignment;

public final class BoxAssignmentService {
    private final Depot depot;
    private final DispatchRepository repository;
    private final EventPublisher publisher;

    public BoxAssignmentService(Depot depot, DispatchRepository repository, EventPublisher publisher) {
        this.depot = depot;
        this.repository = repository;
        this.publisher = publisher;
    }

    public DispatchReceipt assign(AssignBoxCommand command) {
        if (!depot.code().equals(command.depotCode())) throw new IllegalArgumentException("unknown depot");
        FoodBox box = new FoodBox(command.boxId(), command.weightKg());
        if (box.weightKg() > depot.shelfCapacityKg()) throw new IllegalArgumentException("box exceeds shelf capacity");
        if (repository.findByBoxId(box.id()).isPresent()) throw new IllegalStateException("box is already assigned");
        ShelfAssignment assignment = new ShelfAssignment(box.id(), depot.code(), "SHELF-01", DispatchStatus.ASSIGNED);
        DispatchEvent event = new DispatchEvent(command.dispatchId(), box.id(), depot.code(), command.routeDate(), DispatchStatus.ASSIGNED);
        repository.save(assignment);
        publisher.publish(event);
        return new DispatchReceipt(assignment, event);
    }
}
