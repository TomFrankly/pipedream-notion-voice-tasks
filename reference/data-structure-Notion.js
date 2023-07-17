const config = {
    notion_dbs: {
        tasks: {
            id: "",
            properties: {
                Tasks: {
                    id: '%3CM%5DQ',
                    name: 'Tasks',
                    type: 'relation',
                    relation: {
                      database_id: '2fca30c9-df98-4587-8927-c15f65c771dd',
                      type: 'dual_property',
                      dual_property: [Object]
                    }
                  },
                  'Last edited time': {
                    id: 'DZFd',
                    name: 'Last edited time',
                    type: 'last_edited_time',
                    last_edited_time: {}
                  }
            }
        },
        projects: {
            id: "",
            properties: {}
        }
    },
    current_date: "2023-06-12T15:26:04-06:00",
    properties: {
        tasks_name: "",
        tasks_due_date: "",
        tasks_assignee: "",
        tasks_project: "", // Full property
        tasks_source: "",
        tasks_source_value: "",
        tasks_status: "", // Full property
        tasks_status_value: "",
        tasks_kanban_status: "", // Full property
        tasks_kanban_status_value: "",
        tasks_priority: "", // Full property
        tasks_priority_value: "",
        tasks_smart_list: "", // Full property
        tasks_smart_list_value: "",
    },
    filters: {
        status: {
            property: "",
            value: "",
            type: ""
        },
        checkbox: {
            property: "",
            value: "",
        },
        date: {
            property: "",
            value: "",
        }
    }
}

config.filters = {
    ...(this.database_filter_status_value && {
        status: this.database_filter_status_value,
        type: config.notion_dbs.projects.properties,
    }),
    ...(this.database_filter_checkbox_value !== undefined &&
        this.database_filter_checkbox_value !== null && {
            checkbox: this.database_filter_checkbox_value,
        }),
    ...(this.database_filter_date_value && {
        date: this.database_filter_date_value,
    }),
}; 
