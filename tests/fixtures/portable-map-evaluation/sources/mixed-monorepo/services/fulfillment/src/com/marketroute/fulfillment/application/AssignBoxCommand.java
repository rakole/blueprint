package com.marketroute.fulfillment.application;

public record AssignBoxCommand(String dispatchId, String boxId, String depotCode, String routeDate, double weightKg) {}
