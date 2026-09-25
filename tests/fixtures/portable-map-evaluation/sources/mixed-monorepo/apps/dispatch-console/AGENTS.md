# Dispatch console notes

Keep pickup-slot validation and route ordering in `src/domain`; application
services coordinate repositories and contract translation. HTTP modules should
translate requests and responses without owning business rules. The UI files
are small render surfaces and have no browser or runtime dependency.
