package com.blueprint.fixture.lockers.adapter;

import com.blueprint.fixture.lockers.application.ManifestLine;
import com.blueprint.fixture.lockers.application.ManifestReader;
import com.blueprint.fixture.lockers.domain.LockerSize;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class CsvManifestReader implements ManifestReader {
    @Override
    public List<ManifestLine> read(Path path) {
        try {
            List<ManifestLine> lines = new ArrayList<>();
            for (String rawLine : Files.readAllLines(path)) {
                String line = rawLine.trim();
                if (line.isEmpty()) {
                    continue;
                }
                String[] columns = line.split(",", -1);
                if (columns[0].trim().equalsIgnoreCase("trackingId")) {
                    continue;
                }
                if (columns.length != 5) {
                    throw new IllegalArgumentException("Manifest row must contain five columns: " + rawLine);
                }
                lines.add(new ManifestLine(
                        columns[0].trim(),
                        columns[1].trim(),
                        LockerSize.valueOf(columns[2].trim().toUpperCase()),
                        columns[3].trim(),
                        columns[4].trim()));
            }
            return List.copyOf(lines);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read manifest " + path, exception);
        }
    }
}
