import React, { useEffect, useState, useRef } from 'react';

interface VideoFrameSelectorProps {
  videoFile: File;
  onFrameSelect: (frameDataUrl: string, timestamp: number) => void;
  selectedTimestamp?: number;
}

export default function VideoFrameSelector({
  videoFile,
  onFrameSelect,
  selectedTimestamp,
}: VideoFrameSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(selectedTimestamp ?? 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // Create video and canvas elements
  useEffect(() => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.preload = 'metadata';
    v.style.display = 'none';
    document.body.appendChild(v);

    const c = document.createElement('canvas');
    document.body.appendChild(c);

    setVideo(v);
    setCanvas(c);

    return () => {
      document.body.removeChild(v);
      document.body.removeChild(c);
    };
  }, []);

  // Initialize video when file changes
  useEffect(() => {
    if (!videoFile || !video || !canvas) return;

    setLoading(true);
    setError(null);

    try {
      const videoUrl = URL.createObjectURL(videoFile);
      video.src = videoUrl;

      const handleLoadedMetadata = () => {
        console.log('Video loaded:', video.duration, 'seconds');
        setDuration(video.duration);

        const initialTime = selectedTimestamp ?? 0;
        setCurrentTime(initialTime);
        video.currentTime = initialTime;

        // Capture initial frame
        setTimeout(() => {
          captureFrame(initialTime, video, canvas);
          setLoading(false);
        }, 100);
      };

      const handleError = (e: Event) => {
        console.error('Video error:', e);
        setError('Failed to load video. Please try a different file.');
        setLoading(false);
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      video.addEventListener('error', handleError, { once: true });

      // Timeout fallback
      const timeoutId = setTimeout(() => {
        if (loading) {
          setError('Video took too long to load. Please try again.');
          setLoading(false);
        }
      }, 10000);

      return () => {
        clearTimeout(timeoutId);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
        URL.revokeObjectURL(videoUrl);
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Video initialization error:', msg);
      setError(msg);
      setLoading(false);
    }
  }, [videoFile, video, canvas, selectedTimestamp]);

  const captureFrame = (time: number, v: HTMLVideoElement, c: HTMLCanvasElement) => {
    try {
      const ctx = c.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      c.width = v.videoWidth;
      c.height = v.videoHeight;

      ctx.drawImage(v, 0, 0);
      const dataUrl = c.toDataURL('image/jpeg', 0.9);

      onFrameSelect(dataUrl, time);
    } catch (err) {
      console.error('Error capturing frame:', err);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);

    if (!video || !canvas) return;

    video.currentTime = time;

    // Capture frame after seeking completes
    const handleSeeked = () => {
      captureFrame(time, video, canvas);
      video.removeEventListener('seeked', handleSeeked);
    };

    video.addEventListener('seeked', handleSeeked, { once: true });

    // Timeout fallback if seeking doesn't complete
    setTimeout(() => {
      video.removeEventListener('seeked', handleSeeked);
      captureFrame(time, video, canvas);
    }, 500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Loading video preview...</p>
        <div className="w-full h-40 bg-slate-200 rounded-lg animate-pulse flex items-center justify-center">
          <span className="text-slate-500 text-sm">Preparing your video...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700 font-medium">Error loading video</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Select Thumbnail Frame
        </label>
        <p className="text-xs text-slate-500 mb-4">
          Drag the slider to choose which moment from your video will be the thumbnail
        </p>
      </div>

      {/* Canvas Preview - Renders captured frames */}
      {canvas && (
        <div className="bg-black rounded-lg overflow-hidden border border-slate-200">
          <canvas
            ref={() => canvas}
            className="w-full h-auto block"
            style={{ aspectRatio: '16/9', display: 'block', maxWidth: '100%' }}
          />
        </div>
      )}

      {/* Slider and Time Display */}
      {duration > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Current time</span>
            <span className="text-sm font-semibold text-slate-900">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            style={{
              background: `linear-gradient(to right, rgb(147, 51, 234) 0%, rgb(147, 51, 234) ${
                (currentTime / duration) * 100
              }%, rgb(226, 232, 240) ${(currentTime / duration) * 100}%, rgb(226, 232, 240) 100%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}
