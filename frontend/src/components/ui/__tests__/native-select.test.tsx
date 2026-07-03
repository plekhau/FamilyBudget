import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NativeSelect } from '@/components/ui/native-select'

describe('NativeSelect', () => {
  it('renders options and reports selection changes', async () => {
    /** NativeSelect is a plain select: selectOptions works and onChange fires with the value. */
    const onChange = vi.fn()
    render(
      <NativeSelect aria-label="pick" onChange={(e) => onChange(e.target.value)} defaultValue="a">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </NativeSelect>
    )
    await userEvent.selectOptions(screen.getByLabelText('pick'), 'b')
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
