# Stack

## Purpose

MarketRoute is a source-only monorepo with three standard-library components: a TypeScript/JavaScript dispatch console, a Python 3 route-planner worker, and a Java 17 fulfillment service. JSON files in contracts/ carry pickup-slot and dispatch-event vocabularies; SQL, TOML, properties, Markdown, JSON examples, and package metadata are present as file-level evidence.

## Languages and runtimes

The console is an ESM Node application with TypeScript, JavaScript, TSX and JSX sources. The planner is a Python >=3.11 package using Python standard-library modules. Fulfillment uses Java records, interfaces and standard Java 17 APIs.

## Configuration

The console reads MARKETROUTE_DEFAULT_DEPOT and MARKETROUTE_DAILY_BOX_LIMIT. The planner exposes a capacity option with a 40-box default. Fulfillment loads depot, shelf-capacity and event-topic properties with NORTH-01, 18 and dispatch.assigned defaults.

## Coverage boundaries

The prepared inventory represents unsupported Markdown, JSON, TOML, properties, SQL and package metadata at file granularity; several TypeScript, TSX and Python files are partial because unsupported constructs limit structural extraction. Claims about those files stay at file scope.

## Evidence

- `README.md`
- `apps/dispatch-console/package.json`
- `apps/dispatch-console/tsconfig.json`
- `apps/dispatch-console/src/config.ts`
- `workers/route-planner/pyproject.toml`
- `workers/route-planner/src/routeplanner/cli.py`
- `services/fulfillment/README.md`
- `services/fulfillment/config/default.properties`
- `services/fulfillment/src/com/marketroute/fulfillment/config/PropertiesConfigLoader.java`
