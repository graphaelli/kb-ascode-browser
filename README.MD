A Chrome Browser extension that enables downloading saved object(s) from kibana directly from the page using those objects.

Saved objects are exported using the kibana api - https://www.elastic.co/docs/api/doc/kibana/operation/operation-post-saved-objects-export

They are automatically named intelligently based on the content being exported using the naming convention `{title}-{type}.ndjson`, where title is inferred from the context (eg the name of the dashboard, SLO, saved seard, etc) and type is one of the options for "type" in the API (eg The saved object types to include in the export. Valid options depend on enabled plugins, but may include: `visualization, dashboard, search, index-pattern, tag, config, config-global, lens, map, event-annotation-group, query, url, action, alert, alerting_rule_template, apm-indices, cases-user-actions, cases, cases-comments, infrastructure-monitoring-log-view, ml-trained-model, osquery-saved-query, osquery-pack, osquery-pack-asset`)

There are no plans to support other browsers at this time.
