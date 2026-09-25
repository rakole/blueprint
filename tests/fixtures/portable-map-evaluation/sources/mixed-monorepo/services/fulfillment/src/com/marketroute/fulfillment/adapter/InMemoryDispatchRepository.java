package com.marketroute.fulfillment.adapter;

import com.marketroute.fulfillment.application.DispatchRepository;
import com.marketroute.fulfillment.domain.ShelfAssignment;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class InMemoryDispatchRepository implements DispatchRepository {
    private final Map<String, ShelfAssignment> assignments = new HashMap<>();
    public void save(ShelfAssignment assignment) { assignments.put(assignment.boxId(), assignment); }
    public Optional<ShelfAssignment> findByBoxId(String boxId) { return Optional.ofNullable(assignments.get(boxId)); }
}
