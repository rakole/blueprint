package com.marketroute.fulfillment.application;

import com.marketroute.fulfillment.domain.DispatchEvent;

public interface EventPublisher {
    void publish(DispatchEvent event);
}
