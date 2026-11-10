import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FaceId } from "@/components/perk/FaceId";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("Face ID card access", () => {
  it('always plays the successful recording for investments even at a failure random value', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const done = vi.fn();
    render(<FaceId open successOnly onSuccess={done} onCancel={vi.fn()}/>);
    expect(screen.queryByLabelText('Face ID loading')).toBeNull();
    expect(done).not.toHaveBeenCalled();
    fireEvent.ended(screen.getByLabelText('Face ID success'));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("plays success directly and reveals only after it finishes", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.8);
    const reveal = vi.fn();
    render(<FaceId open onSuccess={reveal} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText("Face ID loading")).toBeNull();
    expect(reveal).not.toHaveBeenCalled();
    fireEvent.ended(screen.getByLabelText("Face ID success"));
    expect(reveal).toHaveBeenCalledTimes(1);
  });
  it("keeps details hidden on failure and succeeds on retry", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const reveal = vi.fn();
    render(<FaceId open onSuccess={reveal} onCancel={vi.fn()} />);
    fireEvent.ended(screen.getByLabelText("Face ID loading"));
    fireEvent.ended(screen.getByLabelText("Face ID failed"));
    expect(reveal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Try Face ID Again" }));
    fireEvent.ended(screen.getByLabelText("Face ID success"));
    expect(reveal).toHaveBeenCalledTimes(1);
  });
  it.each([0, 0.199])("fails for random value %s below the 20% threshold", (value) => {
    vi.spyOn(Math, "random").mockReturnValue(value);
    render(<FaceId open onSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.ended(screen.getByLabelText("Face ID loading"));
    expect(screen.getByLabelText("Face ID failed")).toBeTruthy();
  });
  it.each([0.2, 0.499, 0.999])("succeeds directly for random value %s at or above 20%", (value) => {
    vi.spyOn(Math, "random").mockReturnValue(value);
    render(<FaceId open onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText("Face ID success")).toBeTruthy();
    expect(screen.queryByLabelText("Face ID loading")).toBeNull();
  });
});