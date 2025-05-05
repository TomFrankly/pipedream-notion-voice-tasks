export default {
    methods: {
        async calculateGPTCost(usage, model) {
			if (
				!usage ||
				typeof usage !== "object" ||
				!usage.prompt_tokens ||
				!usage.completion_tokens
			) {
				const error = new Error(
					"Invalid usage object (thrown from calculateGPTCost)."
				);
				await this.createFallbackTask(error, true, "chatgpt");
			}

			if (!model || typeof model !== "string") {
				const error = new Error(
					"Invalid model string (thrown from calculateGPTCost)."
				);
				await this.createFallbackTask(error, true, "chatgpt");
			}

			const rates = {
				"gpt-3.5-turbo": {
					prompt: 0.0015,
					completion: 0.002,
				},
				"gpt-3.5-turbo-16k": {
					prompt: 0.003,
					completion: 0.004,
				},
				"gpt-4": {
					prompt: 0.03,
					completion: 0.06,
				},
				"gpt-4-32k": {
					prompt: 0.06,
					completion: 0.12,
				},
			};

			const chatModel = model.includes("gpt-4-32")
				? "gpt-4-32k"
				: model.includes("gpt-4")
				? "gpt-4"
				: model.includes("gpt-3.5-turbo-16k")
				? "gpt-3.5-turbo-16k"
				: "gpt-3.5-turbo";

			if (!rates[chatModel]) {
				const error = new Error(
					"Non-supported model. (thrown from calculateGPTCost)."
				);
				await this.createFallbackTask(error, true, "chatgpt");
			}

			const costs = {
				prompt: (usage.prompt_tokens / 1000) * rates[chatModel].prompt,
				completion:
					(usage.completion_tokens / 1000) * rates[chatModel].completion,
				get total() {
					return this.prompt + this.completion;
				},
			};

			return costs.total;
		}
    }
}