package com.marketroute.fulfillment;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ContractProbe {
    private static final Pattern EVENT_TYPE = Pattern.compile("\\\"eventType\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern STATUS = Pattern.compile("\\\"status\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    public static void main(String[] args) throws IOException {
        String json = new String(System.in.readAllBytes(), StandardCharsets.UTF_8);
        String eventType = match(EVENT_TYPE, json);
        String status = match(STATUS, json);
        if (!"dispatch.assigned".equals(eventType) || !"ASSIGNED".equals(status)) {
            throw new IllegalArgumentException("unexpected dispatch contract");
        }
        System.out.println(eventType + ":" + status);
    }

    private static String match(Pattern pattern, String input) {
        Matcher matcher = pattern.matcher(input);
        if (!matcher.find() || matcher.group(1).isBlank()) throw new IllegalArgumentException("missing contract field");
        return matcher.group(1);
    }
}
