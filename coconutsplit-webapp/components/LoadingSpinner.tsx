export const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="relative">
            <div className="animate-spin  rounded-full h-24 w-24 border-t-2 border-b-2 border-blue-400"></div>
            <div className="rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-max w-max">
                <img
                    src="/logo.png"
                    alt="Coconut Split Logo"
                    className="h-[5.9rem] w-[5.9rem]"
                />
            </div>
        </div>
    </div>
);
