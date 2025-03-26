interface DateSeparatorProps {
    date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
    return (
        <div className="flex items-center my-2 sm:my-4 first:mt-0">
            <div className="flex-grow border-t border-gray-700 mr-2 sm:mr-4"></div>
            <span className="text-gray-400 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1 bg-gray-800 rounded-full">
                {date}
            </span>
            <div className="flex-grow border-t border-gray-700 ml-2 sm:ml-4"></div>
        </div>
    );
}
