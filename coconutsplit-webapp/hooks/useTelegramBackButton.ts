import { useEffect } from 'react';
import { init, backButton } from "@telegram-apps/sdk";

export function useTelegramBackButton(navigateToPath: string) {
    useEffect(() => {
        const initTelegramBackButton = async () => {
            try {
                init();
                backButton.mount();

                if (backButton.show.isAvailable()) {
                    backButton.show();
                    backButton.onClick(() => {
                        window.location.href = navigateToPath;
                    });
                }

                return () => {
                    backButton.hide();
                };
            } catch (error) { }
        };

        const cleanup = initTelegramBackButton();

        return () => {
            if (cleanup) {
                cleanup.then((cleanupFn) => {
                    if (cleanupFn) cleanupFn();
                });
            }
        };
    }, [navigateToPath]);
}
