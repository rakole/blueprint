package com.marketroute.fulfillment;

import com.marketroute.fulfillment.adapter.InMemoryDispatchRepository;
import com.marketroute.fulfillment.adapter.InMemoryEventPublisher;
import com.marketroute.fulfillment.application.AssignBoxCommand;
import com.marketroute.fulfillment.application.BoxAssignmentService;
import com.marketroute.fulfillment.application.DispatchReceipt;
import com.marketroute.fulfillment.domain.Depot;

public final class FulfillmentServiceTest {
    public static void main(String[] args) {
        InMemoryEventPublisher publisher = new InMemoryEventPublisher();
        BoxAssignmentService service = new BoxAssignmentService(new Depot("NORTH-01", 18), new InMemoryDispatchRepository(), publisher);
        DispatchReceipt receipt = service.assign(new AssignBoxCommand("dispatch-1042", "box-2207", "NORTH-01", "2026-09-25", 4));
        assert receipt.assignment().shelfCode().equals("SHELF-01");
        assert receipt.event().eventType().equals("dispatch.assigned");
        assert publisher.events().size() == 1;
    }
}
