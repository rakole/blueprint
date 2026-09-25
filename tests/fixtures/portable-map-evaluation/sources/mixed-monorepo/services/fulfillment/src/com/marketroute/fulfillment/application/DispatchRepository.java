package com.marketroute.fulfillment.application;

import com.marketroute.fulfillment.domain.ShelfAssignment;
import java.util.Optional;

public interface DispatchRepository {
    void save(ShelfAssignment assignment);
    Optional<ShelfAssignment> findByBoxId(String boxId);
}
