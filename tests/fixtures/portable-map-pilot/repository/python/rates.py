"""Small local delivery-rate table used by the parcel desk."""


class RateTable:
    def __init__(self, rates):
        self._rates = dict(rates)

    def quote_shipping(self, destination_zone, weight_kg):
        base_rate = self._rates.get(destination_zone, self._rates["standard"])
        return round(base_rate + (weight_kg * 0.35), 2)
