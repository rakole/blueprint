package com.marketroute.fulfillment.application;

import com.marketroute.fulfillment.domain.DispatchEvent;
import com.marketroute.fulfillment.domain.ShelfAssignment;

public record DispatchReceipt(ShelfAssignment assignment, DispatchEvent event) {}
