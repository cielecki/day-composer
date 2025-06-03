import React, { useCallback } from 'react';
import { SetupStep } from '../../setup/setup-slice';
import { LanguageSelectionScreen } from './LanguageSelectionScreen';
import { AnthropicKeyScreen } from './AnthropicKeyScreen';
import { OpenAIKeyScreen } from './OpenAIKeyScreen';
import { usePluginStore } from '../../store/plugin-store';

interface SetupFlowProps {
	lnModes: Record<string, any>;
}

export const SetupFlow: React.FC<SetupFlowProps> = ({ lnModes }) => {
	const currentStep = usePluginStore(state => state.setup.currentStep);

	const handleStepComplete = useCallback(() => {
		usePluginStore.getState().refreshSetupState();
	}, []);

	switch (currentStep) {
		case SetupStep.CONFIGURE_LANGUAGE:
			return (
				<LanguageSelectionScreen
					onLanguageConfigured={handleStepComplete}
				/>
			);

		case SetupStep.CONFIGURE_ANTHROPIC_KEY:
			return (
				<AnthropicKeyScreen
					onKeyConfigured={handleStepComplete}
				/>
			);

		case SetupStep.CONFIGURE_OPENAI_KEY:
			return (
				<OpenAIKeyScreen
					onKeyConfigured={handleStepComplete}
					onSkip={handleStepComplete}
				/>
			);

		default:
			// This shouldn't happen if setup is working correctly
			return (
				<div style={{ 
					textAlign: 'center', 
					color: 'var(--text-muted)',
					padding: '20px'
				}}>
					Setup complete! Welcome to Life Navigator.
				</div>
			);
	}
}; 