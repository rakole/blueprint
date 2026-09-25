package com.marketroute.fulfillment.adapter;

import com.marketroute.fulfillment.application.EventPublisher;
import com.marketroute.fulfillment.domain.DispatchEvent;
import java.util.ArrayList;
import java.util.List;

public final class InMemoryEventPublisher implements EventPublisher {
    private final List<DispatchEvent> events = new ArrayList<>();
    public void publish(DispatchEvent event) { events.add(event); }
    public List<DispatchEvent> events() { return List.copyOf(events); }
}
