#include <gui/defects_pmp_screen/defects_pmpView.hpp>
#include <gui/common/pmp_colors.hpp>
#include <texts/TextKeysAndLanguages.hpp>

defects_pmpView::defects_pmpView()
    : m_autre_selected(false),
      m_defectCb(this, &defects_pmpView::onDefectClicked),
      m_nextCb(this, &defects_pmpView::onNextClicked),
      m_preciserCb(this, &defects_pmpView::onPreciserClicked)
{
    for (int i = 0; i < DEFECT_COUNT; ++i)
        m_selected[i] = false;
}

void defects_pmpView::setupScreen()
{
    /* Do NOT call defects_pmpViewBase::setupScreen() — the base's transitionBegins()
     * would immediately navigate to summary before the operator acts. */

    for (int i = 0; i < DEFECT_COUNT; ++i)
        m_selected[i] = false;
    m_autre_selected = false;

    DefectButton* btns[DEFECT_COUNT] = {
        &defect_4, &defect_5, &defect_6, &defect_7,
        &defect_8, &defect_9, &defect_10, &defect_other
    };
    for (int i = 0; i < DEFECT_COUNT; ++i)
        btns[i]->setClickAction(m_defectCb);

    next_button.setClickAction(m_nextCb);

    /* Préciser hidden until Autre is selected */
    input_other.setVisible(false);
    input_other.invalidate();
    input_underline_ui.setVisible(false);
    input_underline_ui.invalidate();
    input_other.setClickAction(m_preciserCb);

    updateActionButton();
}

void defects_pmpView::tearDownScreen()
{
    defects_pmpViewBase::tearDownScreen();
}

void defects_pmpView::updateDefectButton(DefectButton& btn, bool selected)
{
    if (selected)
    {
        btn.setBoxWithBorderColors(
            pmp::colors::accent_gold(), pmp::colors::dark_pressed(),
            pmp::colors::brand_teal(), pmp::colors::brand_teal());
        btn.setTextColors(pmp::colors::brand_teal(), pmp::colors::brand_teal());
    }
    else
    {
        btn.setBoxWithBorderColors(
            pmp::colors::brand_teal(), pmp::colors::accent_gold(),
            touchgfx::Color::getColorFromRGB(0, 51, 102),
            touchgfx::Color::getColorFromRGB(51, 102, 153));
        btn.setTextColors(pmp::colors::cream(), touchgfx::Color::getColorFromRGB(10, 10, 10));
    }
    btn.invalidate();
}

void defects_pmpView::updateActionButton()
{
    bool anySelected = false;
    for (int i = 0; i < DEFECT_COUNT; ++i)
        if (m_selected[i]) { anySelected = true; break; }

    if (anySelected)
    {
        next_button.setBoxWithBorderColors(
            pmp::colors::accent_gold(), pmp::colors::dark_pressed(),
            pmp::colors::brand_teal(), pmp::colors::brand_teal());
        next_button.setTextColors(pmp::colors::brand_teal(), pmp::colors::brand_teal());
        next_button.setText(TypedText(T___SINGLEUSE_FQOE)); /* "Suivant" */
    }
    else
    {
        next_button.setBoxWithBorderColors(
            pmp::colors::success_green(), pmp::colors::dark_pressed(),
            pmp::colors::cream(), pmp::colors::cream());
        next_button.setTextColors(pmp::colors::cream(), pmp::colors::cream());
        next_button.setText(TypedText(T_T_PIECE_OK)); /* "Pièce OK" */
    }
    next_button.invalidate();
}

void defects_pmpView::onDefectClicked(const ButtonBase& src, const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;

    DefectButton* btns[DEFECT_COUNT] = {
        &defect_4, &defect_5, &defect_6, &defect_7,
        &defect_8, &defect_9, &defect_10, &defect_other
    };

    for (int i = 0; i < DEFECT_COUNT; ++i)
    {
        if (&src == static_cast<const ButtonBase*>(btns[i]))
        {
            m_selected[i] = !m_selected[i];
            updateDefectButton(*btns[i], m_selected[i]);

            /* Index 7 is Autre — drive the Préciser visibility */
            if (i == DEFECT_COUNT - 1)
            {
                m_autre_selected = m_selected[i];
                input_other.setVisible(m_autre_selected);
                input_other.invalidate();
                input_underline_ui.setVisible(m_autre_selected);
                input_underline_ui.invalidate();
            }
            break;
        }
    }

    updateActionButton();
}

void defects_pmpView::onNextClicked(const ButtonBase& /*src*/, const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;

    bool anySelected = false;
    for (int i = 0; i < DEFECT_COUNT; ++i)
        if (m_selected[i]) { anySelected = true; break; }

    if (anySelected)
    {
        const char* note = ""; /* Préciser text input NYI */
        for (int i = 0; i < DEFECT_COUNT; ++i)
        {
            if (m_selected[i])
                presenter->logDefectInspection(i + 1, (i == DEFECT_COUNT - 1 && m_autre_selected) ? note : "");
        }
    }
    else
    {
        presenter->logOkInspection();
    }

    application().gotosummaryScreenNoTransition();
}

void defects_pmpView::onPreciserClicked(const touchgfx::TextArea& /*src*/,
                                        const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;
    if (m_autre_selected)
        presenter->openKeyboardForPreciser();
}

void defects_pmpView::receivePreciserText(const char* text)
{
    /* DESIGNER ACTION REQUIRED: change input_other widget type from TextArea
     * to TextAreaWithOneWildcard and add a wildcard placeholder in its text
     * resource. Then replace this comment with:
     *     input_other.setWildcard(text); input_other.invalidate();
     * Until then, the Préciser text is silently passed to the note field
     * but not displayed on screen. */
    (void)text;
}
