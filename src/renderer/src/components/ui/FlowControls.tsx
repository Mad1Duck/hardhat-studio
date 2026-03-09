import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FlowControlsProps {
  className?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export function FlowControls({ className, position = 'bottom-left' }: FlowControlsProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const posClass = {
    'bottom-left': 'bottom-3 left-3',
    'bottom-right': 'bottom-3 right-3',
    'top-left': 'top-3 left-3',
    'top-right': 'top-3 right-3',
  }[position];

  return (
    <div className={cn('absolute z-10', posClass, className)}>
      <div className="flex flex-col overflow-hidden bg-white dark:bg-[#151b23] shadow-2xl rounded-xl">
        <button
          onClick={() => zoomIn({ duration: 200 })}
          title="Zoom in"
          className="flex items-center justify-center w-8 h-8 transition-colors text-muted-foreground hover:text-foreground hover:bg-gray-700">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => zoomOut({ duration: 200 })}
          title="Zoom out"
          className="flex items-center justify-center w-8 h-8 transition-colors text-muted-foreground hover:text-foreground hover:bg-gray-700">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="h-px" />

        <button
          onClick={() => fitView({ padding: 0.25, duration: 300 })}
          title="Fit screen"
          className="flex items-center justify-center w-8 h-8 transition-colors text-muted-foreground hover:text-foreground hover:bg-gray-700">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
