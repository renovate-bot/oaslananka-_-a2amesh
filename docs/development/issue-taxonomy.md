# Issue Taxonomy

A2A Mesh uses a label taxonomy to categorize issues and pull requests by product, area, type, and risk.
These labels help triage, prioritize, and track the lifecycle of an issue.

## Fleet Labels

The following labels are specific to Fleet products and controls:

### Product

- `product:fleet`: Fleet product and controls.
- `product:worker-runtime`: Worker execution environment.
- `product:mission-control`: Fleet management surface.

### Area

- `area:scheduler`: Task distribution and scheduling.
- `area:policy`: Policy definition and enforcement.
- `area:artifacts`: Artifact storage and retrieval.
- `area:provider-*`: Provider-specific implementations (e.g., area:provider-aws).
- `area:worker-*`: Worker-specific implementations (e.g., area:worker-node).

### Type

- `type:fleet`: Fleet control-plane change.
- `type:worker`: Worker node runtime change.
- `type:adapter`: Provider adapter integration change.
- `type:policy`: Authorization or operational policy change.
- `type:artifact`: Artifact lifecycle or storage change.
- `type:scheduler`: Task scheduler change.

### Risk

- `risk:credential`: Modifies credential handling or auth flows.
- `risk:destructive-command`: Adds or changes capabilities that delete or overwrite resources.
- `risk:provider-tos`: Involves remote provider interactions that could violate terms of service if malformed.
